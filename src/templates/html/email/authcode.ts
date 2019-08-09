import { format } from "date-fns";

export const emailAuthCode = (secretCode: string, ipaName: string) => ({
  html: `
    <p>Ciao,<br />
    il ${format(new Date(), "DD/MM/YYYY")} alle ore ${format(
    new Date(),
    "HH:mm"
  )} è stata effettuata una richiesta di accesso all'<b>applicazione
    per la dichiarazione di accessibilità dei siti web e delle applicazioni mobili</b>
    relativa all'amministrazione '${ipaName}' per la quale il presente 
    indirizzo e-mail è indicato come referente RTD.</p>
      <br />
    <p>Il codice di accesso all'applicazione é il seguente:</p>
      <br />
    <h2>${secretCode}</h2>
  `,
  title: `Dichiarazione di accessibilità - codice d'accesso`
});
