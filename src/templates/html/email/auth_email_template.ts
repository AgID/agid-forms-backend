import { format } from "date-fns";

export const emailAuthCode = (secretCode: string) => ({
  html: `
  <p>Ciao,<br/>
  in data ${format(new Date(), "DD/MM/YYYY")}
  è stata effettuata una richiesta di verifica email.
  </p>
  <p>
  Il codice di verifica email è il seguente:
  </p>
  <strong>${secretCode}</strong>
  <p>Distinti saluti,</p>
  <p>AGID</p>
  `,
  title: `Form AGID – codice di verifica email`
});
