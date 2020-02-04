import { format } from "date-fns";
import { EmailString } from "italia-ts-commons/lib/strings";
import { HASURA_GRAPHQL_ADMIN_SECRET } from "../../../config";
import { NodeT } from "../../../controllers/graphql_webhook";
import { getDownloadPath } from "../../../uploads/upload-server";

// tslint:disable:no-nested-template-literals

// tslint:disable:no-duplicate-string

export const emailReportPublished = (node: NodeT, userEmail: EmailString) => {
  // tslint:disable-next-line: no-any
  const values = (node.content as any).values;

  const feedbackAttachment = (values["notified-feedback"] || [undefined])[0];
  const answerAttachment = (values["notified-answer"] || [undefined])[0];

  // we must send the hasura admin header key to download a file
  // we don't own as a background process (all downloads are authenticated against the current user)
  const httpHeaders = {
    "X-Hasura-Admin-Secret": HASURA_GRAPHQL_ADMIN_SECRET
  };
  const dummyAttachment = { filename: "", path: "", httpHeaders: undefined };

  return {
    replyTo: userEmail,
    attachments: [
      feedbackAttachment && feedbackAttachment.id
        ? {
            filename: `${feedbackAttachment.filename}`,
            httpHeaders,
            path: getDownloadPath(node.id, node.version, "notified-feedback", 0)
          }
        : dummyAttachment,
      answerAttachment && answerAttachment.id
        ? {
            filename: `${answerAttachment.filename}`,
            httpHeaders,
            path: getDownloadPath(node.id, node.version, "notified-answer", 0)
          }
        : dummyAttachment
    ].filter(v => v.httpHeaders),
    content: `
      Data ${format(new Date(values["reported-date"]), "DD/MM/YYYY")}
      Nome Utente ${values.name}
      Email ${userEmail}
      Soggetto erogatore segnalato ${values["reported-pa"]}
      Indirizzo Web del Servizio ${values["device-type"] === "website"
        ? values["website-url"]
        : values["app-url"]
      }
      Oggetto (DCD-ACCESSIBILITA) Reclamo ${values.name} / ${values["reported-pa"]}
      Messaggio ${values["report-text"]}
      Risposta soggetto erogatore ${values["report-has-answer"]}
      Descrizione reclamo ${values["notified-answer-reason"]}
    `,
    title: `(DCD-ACCESSIBILITA) Reclamo ${values.name} / ${values["reported-pa"]}`
  };
};
