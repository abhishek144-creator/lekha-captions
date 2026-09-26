import unittest

from backend.rendering.cache import render_cache_eligible, render_cache_identity


def _identity(**overrides):
    values = {
        "uid": "owner-a",
        "renderer_version": "renderer-v1",
        "media_hash": "media-hash",
        "captions": [{"text": "Hello", "start_time": 0, "end_time": 1}],
        "style": {"font_family": "Inter", "font_size": 48},
        "quality": "1080p",
        "fps": 30,
        "export_aspect_ratio": "9:16",
    }
    values.update(overrides)
    return render_cache_identity(**values)


class RenderCacheIdentityTests(unittest.TestCase):
    def test_render_cache_reuses_identical_owner_request(self):
        self.assertEqual(_identity(), _identity())

    def test_render_cache_is_tenant_scoped(self):
        self.assertNotEqual(_identity(uid="owner-a"), _identity(uid="owner-b"))

    def test_render_cache_tracks_output_affecting_identity(self):
        baseline = _identity()
        variants = [
            _identity(renderer_version="renderer-v2"),
            _identity(media_hash="other-media"),
            _identity(style={"font_family": "Noto Sans", "font_size": 48}),
            _identity(captions=[{"text": "Changed", "start_time": 0, "end_time": 1}]),
            _identity(quality="720p"),
            _identity(fps=60),
            _identity(export_aspect_ratio="1:1"),
        ]
        self.assertTrue(all(candidate != baseline for candidate in variants))

    def test_template_renders_are_cacheable_by_default(self):
        self.assertTrue(render_cache_eligible(template_export_active=True))

    def test_template_cache_has_an_emergency_disable(self):
        self.assertFalse(render_cache_eligible(
            template_export_active=True,
            template_cache_enabled=False,
        ))

    def test_ass_renders_remain_cacheable_when_template_cache_is_disabled(self):
        self.assertTrue(render_cache_eligible(
            template_export_active=False,
            template_cache_enabled=False,
        ))


if __name__ == "__main__":
    unittest.main()
