import { format } from "date-fns";

export const emailDeclPublished = (id: string, title: string) => ({
  html: `
    <p>Ciao,<br />
    il ${format(new Date(), "DD/MM/YYYY")} alle ore ${format(
    new Date(),
    "HH:mm"
  )} è stata pubblicata la seguente dichiarazione di accessibilità:</p>
      <br />
    <p><a href="https://form.agid.gov.it/view/${id}">${title}</a></p>
`,
  title: `Dichiarazione di accessibilità - contenuto pubblicato`
});
