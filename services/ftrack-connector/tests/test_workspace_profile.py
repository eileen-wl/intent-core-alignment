from intent_core_connector.workspace_profile import FtrackWorkspaceProfile


def test_workspace_profile_has_no_hardcoded_mapping() -> None:
    profile = FtrackWorkspaceProfile(workspace_name="test-workspace")
    assert profile.task_type_to_department == {}
    assert profile.status_mapping == {}
    assert profile.relevant_custom_attributes == []
