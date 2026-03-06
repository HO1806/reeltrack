# ReelTrack Project Rules & Context

- **Environment**: This project is hosted on a local **XAMPP** server.
- **Location**: The project root is `c:\xampp\htdocs\reeltrack`.
- **Deployment**: Any changes meant for production should be deployed/built keeping XAMPP's `htdocs` environment in mind (e.g., using the `/deploy-xampp` workflow).
- **Backend & Frontend**: Ensure paths and routing behave correctly under the `http://localhost/reeltrack/` or similar structure as hosted by Apache in XAMPP.
- **UI/UX & Design Theme**: **CRITICAL** - Whenever instructed to make frontend or UI/UX changes, you **MUST** read `DESIGN.md` first. Always respect the defined dark cinematic color palette, glassmorphic UI tokens, typography, and animation standards. Do not introduce new arbitrary hex colors or override the global theme elements.
- **File Cleanup**: **CRITICAL** - After every set of changes, identify any unused, temporary, or irrelevant files/folders and move them to `unused/`. Ensure the `unused/` directory stays in `.gitignore`. Never move files that are actively imported or required by the running application.
