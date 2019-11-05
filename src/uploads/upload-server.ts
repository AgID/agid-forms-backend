import { ApolloServer, gql } from "apollo-server";
import { FileUpload } from "graphql-upload";
import * as Minio from "minio";
import { ulid } from "ulid";

import {
  MINIO_ACCESS_KEY,
  MINIO_DEFAULT_BUCKETS,
  MINIO_DEFAULT_REGION,
  MINIO_SECRET_KEY,
  MINIO_SERVER_HOST,
  MINIO_SERVER_PORT_NUMBER,
  UPLOAD_SERVER_PORT
} from "../config";
import { log } from "../utils/logger";

// 10MB
const MAX_FILE_SIZE = 10000000;
const MAX_UPLOADED_FILES = 10;

export interface IFileType {
  filename: string;
  id: string;
  mimetype: string;
}

// TODO: real database
// tslint:disable-next-line: readonly-array
const dbGlobal: IFileType[] = [];

/**
 * Stores a GraphQL file upload.
 */
const getStoreUpload = (minioClient: Minio.Client) => async (
  upload: FileUpload,
  bucketName?: string
): Promise<IFileType> => {
  try {
    const { createReadStream, filename, mimetype } = upload;

    // TODO: create file node in hasura and get back
    // node.id (upsert status=draft) and node.user.id
    const id = ulid();

    // TODO: bucketName must start with the current node.user.id

    const computedBucketName =
      bucketName || MINIO_DEFAULT_BUCKETS.split(",")[0];
    log.info("getStoreUpload: handling '%s' %s", computedBucketName, filename);

    // create bucket if not exists
    const bucketExists = await minioClient.bucketExists(computedBucketName);
    if (!bucketExists) {
      log.info("bucket '%s' does not exists, try to create it", bucketName);
      await minioClient.makeBucket(computedBucketName, MINIO_DEFAULT_REGION);
    } else {
      log.info("bucket '%s' exists", bucketName);
    }

    const metaData = {
      filename,
      id,
      mimetype
    };

    // store the file in minio
    await minioClient.putObject(
      computedBucketName,
      filename,
      createReadStream(),
      undefined, // size
      metaData
    );

    const file = { id, filename, mimetype };

    // TODO: update file metadata in hasura (upsert status=published)
    dbGlobal.push(file);

    return file;
  } catch (e) {
    log.info("storeUpload error: %s", JSON.stringify(e));
    throw e;
  }
};

export type StoreUploadT = ReturnType<typeof getStoreUpload>;

const typeDefs = gql`
  type File {
    id: String!
    filename: String!
    mimetype: String!
  }

  type Query {
    uploads: [File]
  }

  type Mutation {
    singleUpload(file: Upload!, bucketName: String): File!
  }
`;

interface IGraphqlUploadContext {
  // tslint:disable-next-line: readonly-array
  db: IFileType[];
  storeUpload: StoreUploadT;
}

const resolvers = {
  Mutation: {
    singleUpload: async (
      // tslint:disable-next-line: no-any
      _: any,
      { file, bucketName }: { file: Promise<FileUpload>; bucketName: string },
      { storeUpload }: IGraphqlUploadContext
    ): Promise<IFileType> => {
      const fileObj = await file;
      log.info("singleUpload: bucket=%s file=%s", bucketName, file);
      const meta = await storeUpload(fileObj, bucketName);
      log.info("singleUpload: meta=%s", JSON.stringify(meta));
      return meta;
    }
  },
  Query: {
    uploads: async (
      // tslint:disable-next-line: no-any
      _: any,
      // tslint:disable-next-line: no-any
      args: any,
      { db }: IGraphqlUploadContext
    ): // tslint:disable-next-line: readonly-array
    Promise<IFileType[]> => {
      // TODO: get metadata from hasura
      log.info("uploads: source (%s) args=(%s)", JSON.stringify(db), args);
      return db;
    }
  }
};

const storeUploadGlobal = getStoreUpload(
  new Minio.Client({
    accessKey: MINIO_ACCESS_KEY,
    endPoint: MINIO_SERVER_HOST,
    port: MINIO_SERVER_PORT_NUMBER,
    secretKey: MINIO_SECRET_KEY,
    useSSL: false
  })
);

const apolloUploadServer = new ApolloServer({
  context: { db: dbGlobal, storeUpload: storeUploadGlobal },
  resolvers,
  typeDefs,
  uploads: {
    // Limits here should be stricter than config for surrounding
    // infrastructure such as Nginx so errors can be handled elegantly by
    // graphql-upload:
    // https://github.com/jaydenseric/graphql-upload#type-processrequestoptions
    maxFileSize: MAX_FILE_SIZE, // 10 MB
    maxFiles: MAX_UPLOADED_FILES
  }
});

apolloUploadServer
  .listen({
    cors: "*",
    port: UPLOAD_SERVER_PORT
  })
  .then(({ url }) => {
    log.info("GraphQL upload server ready at url=%s", url);
  })
  .catch(log.error.bind(log));
