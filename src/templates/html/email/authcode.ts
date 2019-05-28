export const emailAuthCode = (secretCode: string, ipaCode: string) => ({
  html: `
    Codice: ${secretCode}
    IPA: ${ipaCode}
  `,
  title: `Benvenuto !`
});
