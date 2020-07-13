import { EmailString } from "italia-ts-commons/lib/strings";
import { NodeT } from "../../../controllers/graphql_webhook";

// tslint:disable:no-nested-template-literals

// tslint:disable:no-duplicate-string

export const emailFeedbackPublished = (node: NodeT, userEmail: EmailString) => {
  // tslint:disable-next-line: no-any
  const values = (node.content as any).values;
  const serviceType = values["device-type"] === "website"
    ? "sito web"
    : "applicazione mobile";
  const serviceAddress = values["device-type"] === "website"
    ? values["website-url"]
    : values["app-url"];

  return {
    from: userEmail,
    replyTo: userEmail,
    content: `
      Utente: ${values.name}
      Email: ${userEmail}
      Codice fiscale: ${values["tax-number"]}
      Oggetto della richiesta di feedback: ${serviceType}: ${serviceAddress}
      Pagine web/sezioni dell’app mobile segnalate: ${values["feedback-text"]}
      Pagine web/sezioni dell’app mobile non conformi: ${values["feedback-text-compliance"]}
      Strumenti in dotazione: ${values["feedback-tools"]}
    `,
    title: `(FEEDBACK-ACCESSIBILITA) Feedback ${values.name} / AGID`
  };
};
