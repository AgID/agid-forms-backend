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
    html: `
    <p>Il ${format(new Date(), "DD/MM/YYYY")} alle ore ${format(
      new Date(),
      "HH:mm"
    )} è stata recepita la seguente segnalazione di inaccessibilità:</p>
      <br />
    <p>
      <span>Email:</span><br /><span>${userEmail}</span><br /><br />
      <span>Nome e cognome:</span><br /><span>${values.name}</span><br /><br />
      <span>Codice fiscale:</span><br /><span>${
        values["tax-number"]
      }</span><br /><br />
      <span>Soggetto erogatore da segnalare:</span><br /><span>${
        values["reported-pa"]
      }</span><br /><br />
      ${
        values["device-type"] !== "website"
          ? `<span>Nome APP:</span><br /><span>${values["app-name"]}</span><br /><br />`
          : ``
      }
      ${
        values["device-type"] === "website"
          ? `<span>Indirizzo del sito web:</span><br /><span>${values["website-url"]}</span><br /><br />`
          : `<span>Indirizzo APP nello store:</span><br /><span>${values["app-url"]}</span><br /><br />`
      }
      <span>Data della notifica:</span><br /><span>${
        values["reported-date"]
      }</span><br /><br />
      <span>Descrizione del problema:</span><br /><span>${
        values["report-text"]
      }</span><br /><br />

      <span>Ha ricevuto risposta del soggetto erogatore:</span><br /><span>${
        values["report-has-answer"]
      }</span><br /><br />
      <span>Ha una risposta:</span><br /><span>${
        values["report-has-answer"]
      }</span><br /><br />
      ${
        values["notified-answer-reason"]
          ? `<span>Motivi della risposta insoddisfatta:</span><br /><span>${values["notified-answer-reason"]}</span><br /><br />`
          : ``
      }
    </p>
`,
    title: `Segnalazione inaccessibilità ${values.name} / ${values["reported-pa"]}`
  };
};
