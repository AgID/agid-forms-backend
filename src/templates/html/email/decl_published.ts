import { format } from "date-fns";

export const emailDeclPublished = (id: string, title: string) => ({
  html: `
    <p>Ciao,<br />
    il ${format(new Date(), "DD/MM/YYYY")} alle ore ${format(
    new Date(),
    "HH:mm"
  )} è stata pubblicata la seguente dichiarazione di accessibilità:
  <a href="https://form.agid.gov.it/view/${id}">${title}</a></p>.
  <p>Distinti saluti,</p>
  <p>AGID</p>
`,
  title: `Dichiarazione di accessibilità - contenuto pubblicato`
});
