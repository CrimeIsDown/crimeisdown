import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "controller", Path(__file__).resolve().parents[1] / "controller.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ControllerTest(unittest.TestCase):
    def test_private_host_configuration(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "deploy.json"
            cfg = {
                "state_directory": d + "/state",
                "application_directory": d + "/app",
                "repository": "example/project",
                "compose_project": "app",
                "image_prefix": "example/release",
                "health_checks": ["http://127.0.0.1:8000/api/healthz"],
            }
            path.write_text(json.dumps(cfg))
            path.chmod(0o600)
            with patch.multiple(
                m, CONFIG={}, ROOT=Path("."), BASE=Path("."), REPO="", PROJECT="app"
            ):
                m.configure(path)
                self.assertEqual(m.BASE, Path(d) / "app")
                self.assertIn("app", m.compose())
                self.assertEqual(m.REPO, "https://github.com/example/project.git")
            path.chmod(0o644)
            with self.assertRaisesRegex(ValueError, "private"):
                m.configure(path)

    def test_external_health_checks_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "deploy.json"
            path.write_text(
                json.dumps(
                    {
                        "state_directory": d + "/state",
                        "application_directory": d + "/app",
                        "repository": "example/project",
                        "compose_project": "app",
                        "image_prefix": "example/release",
                        "health_checks": ["https://example.com/"],
                    }
                )
            )
            path.chmod(0o600)
            with self.assertRaisesRegex(ValueError, "Loopback"):
                m.configure(path)

    def test_request_validation(self):
        self.assertEqual(
            m.parse_request("deploy v4.0 " + "a" * 40), ["deploy", "v4.0", "a" * 40]
        )
        self.assertEqual(m.parse_request("rollback"), ["rollback"])
        for command in [
            "bash",
            "deploy ../../x " + "a" * 40,
            "deploy v4.0 " + "a" * 39,
            "deploy v4.0 " + "a" * 40 + "; id",
            "rollback extra",
            "deploy v4.0 $(id)",
        ]:
            with self.subTest(command=command), self.assertRaises(ValueError):
                m.parse_request(command)

    def test_changed_tag_never_builds(self):
        with (
            tempfile.TemporaryDirectory() as d,
            patch.object(m, "ROOT", Path(d)),
            patch.object(m, "run") as run,
            patch.object(m.subprocess, "check_output", return_value="b" * 40 + "\n"),
        ):
            with self.assertRaisesRegex(ValueError, "changed"):
                m.prepare("v4.0", "a" * 40)
            self.assertFalse(any("docker" in str(c) for c in run.call_args_list))

    def test_failed_health_restores_previous_without_advancing_state(self):
        with (
            patch.object(m.traceback, "print_exc"),
            tempfile.TemporaryDirectory() as d,
            patch.object(m, "ROOT", Path(d)),
            patch.object(
                m, "transition", side_effect=[RuntimeError("health"), None]
            ) as transition,
        ):
            state = {"current": {"override": "old"}, "previous": None}
            path = Path(d) / "state.json"
            path.write_text(json.dumps(state))
            with self.assertRaisesRegex(RuntimeError, "restored"):
                m.activate({"override": "new"})
            self.assertEqual(
                transition.call_args_list[1].args,
                ({"override": "old"}, {"override": "new"}),
            )
            self.assertEqual(json.loads(path.read_text()), state)

    def test_success_records_previous_config_for_rollback(self):
        with (
            tempfile.TemporaryDirectory() as d,
            patch.object(m, "ROOT", Path(d)),
            patch.object(m, "transition"),
        ):
            path = Path(d) / "state.json"
            path.write_text(
                json.dumps({"current": {"override": "old"}, "previous": None})
            )
            m.activate({"override": "new"})
            self.assertEqual(
                json.loads(path.read_text()),
                {"current": {"override": "new"}, "previous": {"override": "old"}},
            )

    def test_rollback_reuses_saved_target(self):
        with (
            tempfile.TemporaryDirectory() as d,
            patch.object(m, "ROOT", Path(d)),
            patch.object(m, "activate") as activate,
        ):
            (Path(d) / "state.json").write_text(
                json.dumps(
                    {"current": {"override": "new"}, "previous": {"override": "old"}}
                )
            )
            m.execute(["rollback"])
            activate.assert_called_once_with({"override": "old"})

    def test_workers_drain_before_switch(self):
        with patch.object(m, "run") as run, patch.object(m, "check_health"):
            m.transition({"override": "new"}, {"override": "old"})
            self.assertIn("3600", run.call_args_list[0].args[0])
            self.assertIn("stop", run.call_args_list[0].args[0])
            self.assertIn("--no-build", run.call_args_list[1].args[0])
            self.assertIn("--wait", run.call_args_list[1].args[0])


if __name__ == "__main__":
    unittest.main()
