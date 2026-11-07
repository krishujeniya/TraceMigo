# Public web artifact checks

Build the workspace, then run the local guard:

```bash
pnpm build
pnpm security:check
```

`pnpm build` automatically runs the artifact scan after all workspace builds succeed. `security:check` additionally runs synthetic scanner tests and inspects `apps/web/public`, `.next/static`, and prerendered HTML/RSC/body/text output under `.next/server/app`. A production BUILD_ID, nonempty static/public trees and rendered output are required. Missing files/builds and unexpected symlinks fail; no integration service is substituted with success.

The guard rejects known private authority/answer markers, PEM private-key headers, synthetic private canaries, source maps/references and forbidden private/fixture/environment paths. Public archives are rejected because their compressed contents are not inspected. Files above 32 MiB fail explicitly rather than being silently skipped. Failures print only artifact paths and rule identifiers, never matched content. Seeded tests create disposable synthetic trees outside application assets and remove them afterward.

This is a bounded pattern/path check. It does not identify every secret, encoded/obfuscated data, arbitrary answer text or image steganography. The fixed public warmup examples and their explanatory traces are intentionally public; they are not sealed assessment material. The scanner does not inspect private server JavaScript as public output, certify authorization or replace tenant/isolation tests, secret-scanning tools, independent security review or release acceptance.

P01.03 still needs credential-safe CI, dependency/license/image scanning, SBOM/provenance and actual workflow evidence. Run this guard after any change to source, public files, generated assets or build configuration. A pass applies to the artifacts present at check time; it does not automatically authorize deployment. Review scan scope when rendering or downloadable formats change.
