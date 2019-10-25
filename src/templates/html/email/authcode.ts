import { format } from "date-fns";

export const emailAuthCode = (
  secretCode: string,
  ipaName: string,
  ipaCode: string
) => ({
  html: `
  <p>All’attenzione dell’RTD dell’Amministrazione '${ipaName}',
  in data ${format(new Date(), "DD/MM/YYYY")} alle ore ${format(
    new Date(),
    "HH:mm"
  )} è stata effettuata una richiesta di accesso al servizio eForm
  di AGID che permette la compilazione di moduli online.
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
  title: `eForm AGID - codice d'accesso`
});
