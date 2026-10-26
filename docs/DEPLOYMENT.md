# Release deployment

Publishing a stable versioned release queues the **Deploy release** workflow.
It resolves the tag to an exact commit on `main` and runs the public validation
suite against that commit. The `production` environment then requires approval
from a configured reviewer before deployment credentials become available.

For an existing release, run the workflow from `main`, choose `deploy`, and
enter its tag. Tags use `vMAJOR.MINOR` or `vMAJOR.MINOR.PATCH`. Draft and
prerelease releases are not eligible. The server rechecks the tag and commit
before building, so moving a tag cannot silently change an approved deployment.

## Private deployment boundary

GitHub holds only environment-scoped SSH connection credentials: `DEPLOY_HOST`,
`DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_HOST_KEY`, and `DEPLOY_SSH_KEY`. Host keys
are pinned. The deployment key invokes a restricted server command; it cannot
open an interactive shell, forward connections, or upload arbitrary files.

Application secrets, membership mappings, notification destinations, runtime
settings, and frontend build settings stay on the server. The server builds
from the public release source, snapshots private configuration per deployment,
and retains the previous application images. Operational inventory and the
server deployment controller are maintained privately. Build logs remain there.

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
