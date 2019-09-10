import { format } from "date-fns";

export const emailAuthCode = (
  secretCode: string,
  ipaName: string,
  ipaCode: string
) => ({
  html: `
  <p>All’attenzione dell’RTD dell’Amministrazione '${ipaName}',<br />
  in data ${format(new Date(), "DD/MM/YYYY")} alle ore ${format(
    new Date(),
    "HH:mm"
  )} è stata effettuata una richiesta di accesso al servizio on line di AGID
  per la compilazione della dichiarazione di accessibilità di tutti siti web
  e delle applicazioni mobili della vostra amministrazione.
  </p>
  <p>
  Per accedere al servizio è necessario collegarsi alla seguente pagina 
  [https://form.agid.gov.it](https://form.agid.gov.it/?ipa=${ipaCode})
  inserendo la chiave di accesso:
  </p>
  <h2>${secretCode}</h2>
  <p>Distinti saluti,</p>
  <p>AGID</p>
  `,
  title: `Dichiarazione di accessibilità - codice d'accesso`
});
