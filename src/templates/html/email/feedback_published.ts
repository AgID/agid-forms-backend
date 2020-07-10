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
      <p>Utente:<br>${values.name}</p>
      <p>Email:<br>${userEmail}</p>
      <p>Codice fiscale:<br>${values["tax-number"]}</p>
      <p>Oggetto della richiesta di feedback:<br>${serviceType}: ${serviceAddress}</p>
      <p>Pagine web/sezioni dell’app mobile segnalate:<br>${values["feedback-text"]}</p>
      <p>Pagine web/sezioni dell’app mobile non conformi:<br>${values["feedback-text-compliance"]}</p>
      <p>Strumenti in dotazione:<br>${values["feedback-tools"]}</p>
    `,
    title: `Feedback accessibilità ${serviceAddress} - ${values.name}`
  };
};
