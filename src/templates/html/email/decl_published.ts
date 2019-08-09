export const emailDeclPublished = (url: string) => ({
  html: `
    Contenuto pubblicato
    URL: ${url}
  `,
  title: `Contenuto pubblicato !`
});
