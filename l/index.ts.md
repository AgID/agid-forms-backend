import express from "express";
import { readFileSync } from "fs";

import { authenticate, initialize, use } from "passport";
import SpidStrategy from "spid-passport";

const app = express();

// init passport
app.use(initialize());

const spidStrategy = new SpidStrategy(
  {
    sp: {
      callbackUrl: "http://134.209.233.85:7777/acs",
      issuer: "https://134.209.233.85:7777",
      privateCert: readFileSync("./certs/sp.key", "utf-8"),
      decryptionPvk: readFileSync("./certs/sp.key", "utf-8"),
      attributeConsumingServiceIndex: 1,
      identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      authnContext: "https://www.spid.gov.it/SpidL1",
      attributes: {
        name: "Required attributes",
        attributes: ["fiscalNumber", "name", "familyName", "email"]
      },
      organization: {
        name: "AGID",
        displayName: "Agenzia per l'Italia digitale",
        URL: "https://www.agid.gov.it"
      }
    },
    idp: {
      test: {
        entryPoint: "http://134.209.233.85:8088/sso",
        cert:
          "MIIC8DCCAdigAwIBAgIJAPVB24UKjkIDMA0GCSqGSIb3DQEBCwUAMA0xCzAJBgNV BAYTAklUMB4XDTE5MDQwMTEzMTcwNFoXDTE5MDUwMTEzMTcwNFowDTELMAkGA1UE BhMCSVQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDFd04KFg07qBiG htBF+BLTrNr8SE0UjPIdCPUuvhQFgsRpylc0OD1mvhrO311aQMmD0Qdft5Zv5zLh rXcXJN7zffM4MnYta77lisRMXRmSnuUjunVruqNKGGiWJQOFP2iRwoNBbfr8tPOR T7cZ19zoll1dLajZuFoCL8bJJOFklUMx59iO2exzcpTDBxra0TrebetPl675ZPNV Wdje/CyoB84AFVQo6sBD+qbYlqyCdcP6wJ2o2jRN/+elJol1BQ3DpXYv+pkhsA00 S6b5ttrr83giPq5poE0d0diOdGkUspgDbGnXpMQ91F05aKH2PiJpoa5RAKW7B/aE KiwyoB49AgMBAAGjUzBRMB0GA1UdDgQWBBSKigsZNjtRSqMweYz5EK5BzlQjGDAf BgNVHSMEGDAWgBSKigsZNjtRSqMweYz5EK5BzlQjGDAPBgNVHRMBAf8EBTADAQH/ MA0GCSqGSIb3DQEBCwUAA4IBAQB2bUzHz42rbvh9YrNGFMIb8GLhPipWnr9jcFmV fAJfEiri+K18N/nWpjb4kVlMr8zzN8YCeKYD+NfC9WD4BYYV2p+OqGtBi9epypRG f7bPdd+grp6OszAbQ5U488jBKO6N7TAOfx/PYnz/k6DgDt66oN41BjCimNqISpw0 MBlE2Ujf7Ri8xvhurTpBaYkLfkgrGVXXlllTrtb1hwHFDro6od0rBmD5jleSFQ+V 5MczvWB/qSNGra7x20wdTJD5YS2rz7oKw3wJN5yBaoIYt3/rzcMJldcRM++I1OzC oDS6fF2l412cXfrtm/Wm7TY/eMwpTp/1wOfyU9VmhRl9XPit"
      }
    }
  },
  function(profile, done) {
    // Find or create user
    console.log(profile);
    done(null, profile);
  }
);

use(spidStrategy);

app.get("/login", authenticate("spid"));

app.post("/acs", authenticate("spid", { session: false }), function(req, res) {
  console.log(req.user);
  res.send(`Hello ${req.user.name_id}`);
});

// Create xml metadata
app.get("/metadata", spidStrategy.generateServiceProviderMetadata());

app.listen(7777);
