import { format } from "date-fns";

export const emailAuthCode = (
  secretCode: string,
  ipaName: string,
  ipaCode: string,
  isSchool: boolean
) => ({
  html: `
  <p>All’attenzione ${!isSchool ? 'dell’RTD dell’amministrazione' : 'del DS presso'} '${ipaName}',
  <br>
  in data ${format(new Date(), "DD/MM/YYYY")}
  è stata effettuata una richiesta di accesso al servizio Form
  AGID che permette la compilazione di moduli online.
  </p>
  <p>
  Per accedere al servizio è necessario collegarsi alla seguente pagina
  <a href="https://form.agid.gov.it/?ipa=${ipaCode}">form.agid.gov.it</a>
  inserendo la chiave di accesso:
  </p>
  <h2>${secretCode}</h2>
  <p>Distinti saluti,</p>
  <p>AGID</p>
  `,
  title: `Form AGID - codice d'accesso`
});
