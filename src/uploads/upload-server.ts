import { ApolloServer, gql } from "apollo-server";
import { FileUpload } from "graphql-upload";
import * as Minio from "minio";
import { ulid } from "ulid";

import {
  MINIO_ACCESS_KEY,
  MINIO_DEFAULT_REGION,
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_SECRET_KEY,
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
const dbGlobal: Record<string, IFileType> = {};

/**
 * Stores a GraphQL file upload.
 */
const getStoreUpload = (minioClient: Minio.Client) => async (
  bucketName: string,
  upload: FileUpload
): Promise<IFileType> => {
  const { createReadStream, filename, mimetype } = upload;

  // TODO: create file node in hasura and get back
  // node.id (upsert status=draft)
  const id = ulid();

  // create bucket if not exists
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    log.info("bucket '%s' does not exists, try to create it", bucketName);
    await minioClient.makeBucket(bucketName, MINIO_DEFAULT_REGION);
  }

  const metaData = {
    filename,
    id,
    mimetype
  };

  // store the file in minio
  await minioClient.putObject(
    bucketName,
    filename,
    createReadStream(),
    undefined, // size
    metaData
  );

  const file = { id, filename, mimetype };

  // TODO: update file metadata in hasura (upsert status=published)
  // tslint:disable-next-line: no-object-mutation
  dbGlobal[id] = file;

  return file;
};

export type StoreUploadT = ReturnType<typeof getStoreUpload>;

const typeDefs = gql`
  type File {
    filename: String!
    mimetype: String!
    encoding: String!
  }

  type Query {
    uploads: [File]
  }

  type Mutation {
    singleUpload(file: Upload!): File!
  }
`;

interface IGraphqlUploadContext {
  db: Record<string, IFileType>;
  storeUpload: StoreUploadT;
}

const resolvers = {
  Mutation: {
    singleUpload: async (
      // tslint:disable-next-line: no-any
      _: any,
      { file, bucketName }: { file: Promise<FileUpload>; bucketName: string },
      { db, storeUpload }: IGraphqlUploadContext
    ) => {
      const fileObj = await file;
      const meta = await storeUpload(bucketName, fileObj);
      log.info("source (%s) args=(%s)", meta, db);
    }
  },
  Query: {
    uploads: async (
      // tslint:disable-next-line: no-any
      _: any,
      // tslint:disable-next-line: no-any
      args: any,
      { db }: IGraphqlUploadContext
    ) => {
      // TODO: get metadata from minio (or DB) for each file
      log.info("source (%s) args=(%s)", args, db);
      return db;
    }
  }
};

const storeUploadGlobal = getStoreUpload(
  new Minio.Client({
    accessKey: MINIO_ACCESS_KEY,
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    secretKey: MINIO_SECRET_KEY
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
