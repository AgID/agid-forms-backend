import { format } from "date-fns";

export const emailAuthCode = (secretCode: string) => ({
  html: `
  <p>Ciao,<br/>
  in data ${format(new Date(), "DD/MM/YYYY")} 
  è stata effettuata una richiesta
  di accesso al <a href="https://form.agid.gov.it">servizio eForm di AGID</a>
  che permette la compilazione di moduli online.
  </p>
  <p>
  La chiave di accesso per confermare l'indirizzo email è:
  </p>
  <h2>${secretCode}</h2>
  <p>Distinti saluti,</p>
  <p>AGID</p>
  `,
  title: `eForm AGID - chiave d'accesso`
});
