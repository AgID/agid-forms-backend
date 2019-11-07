import { gql } from "apollo-server";
import { ApolloServer as ApolloServerExpress } from "apollo-server-express";
import * as cors from "cors";
import * as express from "express";
import { FileUpload } from "graphql-upload";
import helmet = require("helmet");
import * as http from "http";
import * as Minio from "minio";
import morgan = require("morgan");

import {
  GET_NODE_REVISION,
  GraphqlClient,
  INSERT_NODE
} from "../clients/graphql";
import {
  MAX_FILE_SIZE,
  MAX_UPLOADED_FILES,
  MINIO_ACCESS_KEY,
  MINIO_DEFAULT_REGION,
  MINIO_SECRET_KEY,
  MINIO_SERVER_HOST,
  MINIO_SERVER_PORT_NUMBER,
  UPLOAD_SERVER_PORT
} from "../config";
import {
  GetNodeRevision,
  GetNodeRevisionVariables
} from "../generated/graphql/GetNodeRevision";
import {
  InsertNode,
  InsertNodeVariables
} from "../generated/graphql/InsertNode";
import { log } from "../utils/logger";

export interface IFileType {
  filename: string;
  id: string;
  mimetype: string;
  version: number;
}

const globalMinioClient = new Minio.Client({
  accessKey: MINIO_ACCESS_KEY,
  endPoint: MINIO_SERVER_HOST,
  port: MINIO_SERVER_PORT_NUMBER,
  secretKey: MINIO_SECRET_KEY,
  useSSL: false
});

const getStoredDownload = (minioClient: Minio.Client) => async (
  jwt: string | undefined,
  response: express.Response,
  parentNodeId: string,
  parentNodeVersion: number,
  fieldName: string,
  index: number
) => {
  try {
    log.debug("storedDownload: id:%s for jwt:%s", parentNodeId, jwt);

    // we forward the jwt passed from client (browser)
    // to check required rights against the node table
    // some files may be public and do not need a jwt
    const getResult = await GraphqlClient.query<
      GetNodeRevision,
      GetNodeRevisionVariables
    >({
      context: {
        clientName: "forwarding",
        headers: jwt
          ? {
              Authorization: jwt
            }
          : {}
      },
      query: GET_NODE_REVISION,
      variables: {
        id: parentNodeId,
        version: parentNodeVersion
      }
    });

    if (getResult.errors) {
      throw new Error(
        `Cannot get node for attachment: ${JSON.stringify(getResult.errors)}`
      );
    }

    if (
      !getResult.data ||
      !getResult.data.revision ||
      !getResult.data.revision[0]
    ) {
      throw new Error(`Cannot get node for id: ${parentNodeId}`);
    }

    const node = getResult.data.revision[0];
    if (
      !node.content.values ||
      !node.content.values[fieldName] ||
      !node.content.values[fieldName][index]
    ) {
      throw new Error(
        `Cannot get file reference for id: ${parentNodeId} fieldName=${fieldName} index=${index}`
      );
    }

    // get file node id and version from reference
    const fileRef = node.content.values[fieldName][index];
    if (!fileRef.id || !fileRef.version) {
      throw new Error(
        `Cannot get id / version for id: ${parentNodeId} fieldName=${fieldName} index=${index}`
      );
    }

    // retrieve fileNode
    // no matter what permission we have here now
    // so we query using the admin account credentials
    const fileNodeResult = await GraphqlClient.query<
      GetNodeRevision,
      GetNodeRevisionVariables
    >({
      query: GET_NODE_REVISION,
      variables: {
        id: fileRef.id,
        version: fileRef.version
      }
    });

    if (fileNodeResult.errors) {
      throw new Error(
        `Cannot get file node for attachment: ${JSON.stringify(
          fileNodeResult.errors
        )}`
      );
    }

    if (
      !fileNodeResult.data ||
      !fileNodeResult.data.revision ||
      !fileNodeResult.data.revision[0]
    ) {
      throw new Error(`Cannot get file node for id: ${fileRef.id}`);
    }

    const fileNode = fileNodeResult.data.revision[0];

    const computedBucketName = fileNode.user_id;

    log.debug(
      "storedDownload: serving '%s/%s",
      computedBucketName,
      fileNode.id
    );

    // retrive the readstream from minio
    const fileStream = await minioClient.getObject(
      computedBucketName,
      fileNode.id
    );

    fileStream.on("error", error => {
      // tslint:disable-next-line: no-duplicate-string
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("error retrieving file: " + JSON.stringify(error));
    });

    fileStream.on("open", () => {
      response.writeHead(200, { "Content-Type": node.content.mimetype });
    });

    fileStream.on("end", () => {
      log.info("sent file %s", fileNode.id);
    });

    fileStream.pipe(response);
  } catch (e) {
    log.error("storedDownload error: %s", e.message);
    throw e;
  }
};

const storeDownload = getStoredDownload(globalMinioClient);

/**
 * Stores a GraphQL file upload.
 */
const getStoreUpload = (minioClient: Minio.Client) => async (
  jwt: string,
  upload: FileUpload
): Promise<IFileType> => {
  try {
    const { createReadStream, filename, mimetype } = upload;

    log.info("storeUpload: using jwt=%s", jwt);

    const nodeContent = {
      node: {
        content: {
          filename,
          mimetype
        },
        language: "it",
        status: "draft",
        title: filename,
        type: "file"
      }
    };

    // we forward the jwt passed from client (browser)
    // to check required rights against the node table
    const insertResult = await GraphqlClient.mutate<
      InsertNode,
      InsertNodeVariables
    >({
      context: {
        clientName: "forwarding",
        headers: {
          Authorization: jwt
        }
      },
      mutation: INSERT_NODE,
      variables: nodeContent
    });

    if (insertResult.errors) {
      throw new Error(
        "Cannot create new node for attachment: " +
          JSON.stringify(insertResult.errors)
      );
    }

    if (
      !insertResult.data ||
      !insertResult.data.insert_node ||
      !insertResult.data.insert_node.returning ||
      !insertResult.data.insert_node.returning[0]
    ) {
      throw new Error("Cannot create new node");
    }

    const node = insertResult.data.insert_node.returning[0];

    const computedBucketName = node.user_id;

    log.info("getStoreUpload: handling '%s' %s", computedBucketName, filename);

    // create bucket if not exists
    const isExistingBucket = await minioClient.bucketExists(computedBucketName);
    if (!isExistingBucket) {
      log.info(
        "bucket '%s' does not exists, try to create it",
        computedBucketName
      );
      await minioClient.makeBucket(computedBucketName, MINIO_DEFAULT_REGION);
    } else {
      log.info("bucket '%s' exists", computedBucketName);
    }

    const metaData = {
      filename,
      id: node.id,
      mimetype
    };

    // store the file in minio
    // object name id the node.id
    await minioClient.putObject(
      computedBucketName,
      node.id,
      createReadStream(),
      undefined, // size
      metaData
    );

    return { ...metaData, version: node.version };
  } catch (e) {
    log.info("storeUpload error: %s", e.message);
    throw e;
  }
};

export type StoreUploadT = ReturnType<typeof getStoreUpload>;

const typeDefs = gql`
  type File {
    id: String!
    version: Int!
    filename: String!
    mimetype: String!
  }

  type Mutation {
    singleUpload(file: Upload!): File!
  }

  type Query {
    download(id: String!): String
  }
`;

interface IGraphqlUploadContext {
  jwt: string;
  storeUpload: StoreUploadT;
}

const resolvers = {
  Mutation: {
    singleUpload: async (
      // tslint:disable-next-line: no-any
      _: any,
      { file }: { file: Promise<FileUpload> },
      { jwt, storeUpload }: IGraphqlUploadContext
    ): Promise<IFileType> => {
      const fileObj = await file;
      log.info("singleUpload: file=%s", file);
      const meta = await storeUpload(jwt, fileObj);
      log.info("singleUpload: meta=%s", JSON.stringify(meta));
      return meta;
    }
  },
  Query: {
    // needed to satisfy apollo server bootstrap
    download: () => void 0
  }
};

const apolloUploadServer = new ApolloServerExpress({
  context: ({ req }) => {
    return {
      jwt: req.header("Authorization"),
      storeUpload: getStoreUpload(globalMinioClient)
    };
  },
  resolvers,
  typeDefs,
  uploads: {
    // Limits here should be stricter than config for surrounding
    // infrastructure such as Nginx so errors can be handled elegantly by
    // graphql-upload:
    // https://github.com/jaydenseric/graphql-upload#type-processrequestoptions
    maxFileSize: MAX_FILE_SIZE,
    maxFiles: MAX_UPLOADED_FILES
  }
});

// Create and setup the Express app.
const app = express();

// Add security to http headers.
app.use(helmet());
app.use(helmet.frameguard({ action: "sameorigin" }));

// Set up CORS (free access to the API from browser clients)
app.use(
  cors({
    exposedHeaders: ["retry-after", "x-ratelimit-reset"]
  })
);

// Add a request logger.
const loggerFormat =
  ":date[iso] [info]: :method :url :status - :response-time ms";
app.use(morgan(loggerFormat));

app.get(
  `/file/:parent_node_id/:parent_node_version/:field_name/:index`,
  async (req: express.Request, res: express.Response) => {
    const jwt = req.headers.authorization;
    try {
      return await storeDownload(
        jwt,
        res,
        req.params.parent_node_id,
        req.params.parent_node_version,
        req.params.field_name,
        req.params.index
      );
    } catch (e) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`error retrieving file: ${e.message}`);
    }
  }
);

apolloUploadServer.applyMiddleware({ app });

// HTTPS is terminated by proxy
http.createServer(app).listen(UPLOAD_SERVER_PORT, () => {
  log.info("Listening on port %d", UPLOAD_SERVER_PORT);
});
