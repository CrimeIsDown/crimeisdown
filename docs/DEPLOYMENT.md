# Release deployment

Publishing a stable versioned release queues the **Deploy release** workflow.
It resolves the tag to an exact commit on `main` and runs the public validation
suite against that commit. The `production` environment then requires approval
from a configured reviewer before deployment credentials become available.

For an existing release, run the workflow from `main`, choose `deploy`, and
enter its tag. Tags use `vMAJOR.MINOR` or `vMAJOR.MINOR.PATCH`. Draft and
prerelease releases are not eligible. The server rechecks the tag and commit
before building, so moving a tag cannot silently change an approved deployment.

Deploying the currently active commit only rechecks health; it does not rebuild
images or take a new configuration snapshot. Changes to frontend build settings
therefore require a release at a new commit. Update the private settings before
publishing that release, and verify the affected public feature after deployment.

## Private deployment boundary

GitHub holds only environment-scoped SSH connection credentials: `DEPLOY_HOST`,
`DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_HOST_KEY`, and `DEPLOY_SSH_KEY`. Host keys
are pinned. The deployment key invokes a restricted server command; it cannot
open an interactive shell, forward connections, or upload arbitrary files.

Application secrets, membership mappings, notification destinations, runtime
settings, and frontend build settings stay on the server. The server builds
from the public release source, snapshots private configuration per deployment,
and retains the previous application images. The reusable controller and its tests live in `scripts/deploy/`. Host paths,
service bindings, private inventory, configuration snapshots, and build logs
remain on the server.

No database migration, seed, database restore, or automatic data cleanup is part
of deployment. Existing records, shared sessions, and background-job state remain
in their existing services. Deployments are serialized, workers are stopped
gracefully, and the previous images/configuration are restored if health checks
fail. Image rollback does not reverse application writes to shared data.

## Rollback

Run **Deploy release** from `main` with operation `rollback`. It requires the
same environment approval and restores the previous successful application
images and configuration. The server also retains an operator recovery command
for use if GitHub is unavailable, and the earlier platform rollback remains
separate. Do not restore a database backup for an application rollback.

Approvers should review the exact commit, validation results, and release notes.
A successful workflow records the deployment in the GitHub environment history.

## Controller installation

Install the reviewed `scripts/deploy/controller.py` on the deployment host as the
forced command for the deployment SSH key. The controller reads a root-owned,
mode-0600 `/etc/crimeisdown/deploy.json`; the checked-in example illustrates the
schema using dummy paths and bindings. Never commit the populated file.

`application_directory` is a stable application path, independent of the release
version or date. `state_directory` holds private configuration, retained release
snapshots, logs, and current/previous deployment state. The Compose project name
stays stable so application updates retain existing networks and volumes.

The application directory must contain the operator-maintained `compose.yml`.
The state directory must contain `config/` with `backend.env`, `compat.env`
(raw environment-file format), `frontend-build.env`, `frontend-runtime.env`,
`notifications.json`, and the dispatch-only `production_beat.py`. Initialize
`state.json` with the current deployment before allowing the first update;
`override: null` selects the original Compose configuration. Protect this tree
from unprivileged host users. The deployment key cannot edit these files.

Updating the controller is an operator action, separate from deploying an
application release; installing reviewed tooling prevents an application tag
from silently replacing the host controller. Run its tests with:

```sh
python3 -m unittest discover -s scripts/deploy/tests
```
