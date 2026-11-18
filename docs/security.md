# Security model and verification limits

## Identity and access

ASP.NET Core Identity stores salted password hashes. Browser sessions use an HttpOnly cookie, an eight-hour lifetime, SameSite=Lax and Secure outside Development/Testing. The browser stores no session token in localStorage. Every unsafe API method, including login and registration, validates an ASP.NET antiforgery token supplied in a header. Authentication failures use one generic response. Five failed credentials lock an account for fifteen minutes; IP rate limits additionally constrain authentication and general API traffic.

The server determines the current user from the session. Resource queries bind that user to the actual enrollment, course, submission or ticket. Student registration cannot assign staff privileges. Administrators cannot remove their own access. Changing privileges, disabling an account or changing its password invalidates old security stamps; cookies are checked on every request. Staff who own live courses must have those courses reassigned or archived before losing staff access.

Production must use HTTPS and persist Data Protection keys in a directory restricted to the application identity. Behind a TLS-terminating proxy, configure the single trusted proxy IP with `ReverseProxy__Address`; arbitrary forwarded headers are not trusted. Rate limits are in-process and are appropriate for the documented single-instance deployment. A multi-instance deployment needs shared throttling and keys.

## Content and data

The API uses explicit DTOs and bounded server validation. EF Core parameterizes queries; the few raw row-lock queries use parameterized interpolated SQL. Unique indexes and row locks protect enrollment, attempt retries and certificate issuance. Published curricula require complete modules and ten-question assessments. Content is locked after approved enrollment. Quiz answers are omitted from pre-submission responses; attempts retain scores and feedback without overwriting history.

React renders text normally; Markdown does not enable raw HTML. No submitted code is executed. CSP restricts scripts to the application, disables embedded objects and framing, and allows inline style only for presentation. Media is stored outside the public web root with generated names. Reads verify course ownership or approved enrollment and support byte ranges. Uploads verify signatures, bound size and count, reject SVG/HTML, require video text alternatives and accept only PNG/JPEG/WebP/MP4/WebM. This is a format gate, not malware scanning or full media transcoding. Configure storage quotas and operational scanning if accepting files from a wider staff population. Original filenames are never used as filesystem paths.

No request bodies, passwords, tokens or submitted answers are deliberately logged. Database sensitive-data logging is off. Production failures return generic messages and a trace identifier. Backups contain private information and require access control, encryption, retention and restore testing. Public certificate lookup requires a random UUID and reveals only the certificate snapshot, never email or submitted work.

## Dependency checks

Run `node scripts/audit-dependencies.mjs` and the NuGet audit commands in the README. The npm check audits both production and development dependencies. Production advisories and new toolchain advisories fail verification. One existing, unpatched development-only issue is explicitly reported:

- [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): picomatch through 4.0.7 can exhibit ReDoS for crafted extglob patterns. The upstream advisory lists no patched release as checked on 2026-11-18. Vite/Vitest file discovery brings this into the development toolchain. The shipped ASP.NET/React application accepts no user-supplied glob expressions and does not ship Vite or Vitest as a production server. Use trusted source trees for builds and local-only development servers; recheck upstream and remove this exception when a fix becomes available.

The audit does not constitute a penetration test, guarantee absence of vulnerabilities, or scan the deployed host. Package databases may change after a successful run. Docker base images and the production operating system need their own ongoing patching and image scan. The initial release does not provide MFA, email confirmation, self-service password reset, automated data erasure, payment processing or a managed video CDN.

## Reference guidance

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [ASP.NET Core antiforgery](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0)
- [ASP.NET Core Data Protection](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/introduction?view=aspnetcore-10.0)
