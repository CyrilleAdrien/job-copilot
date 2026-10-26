from jobcopilot_documents.schemas import CvDraft, LetterDraft, Selection
from jobcopilot_documents.writer import DemoWriter, LLMWriter


class FakeLLM:
    model = "fake"

    def __init__(self, answers):
        self.answers = answers
        self.prompts: list[str] = []

    async def complete(self, system, prompt, schema):
        self.prompts.append(prompt)
        return schema.model_validate(self.answers[schema.__name__])


async def test_selection_drops_unknown_indexes(profile, offer):
    llm = FakeLLM({"Selection": {"requirements": ["Kubernetes"], "experience_indexes": [1, 9, -1]}})
    selection = await LLMWriter(llm).select(profile, offer)
    assert selection.experience_indexes == [1]
    assert "Kubernetes" in llm.prompts[0]


async def test_empty_selection_keeps_every_experience(profile, offer):
    llm = FakeLLM({"Selection": {"requirements": [], "experience_indexes": []}})
    assert (await LLMWriter(llm).select(profile, offer)).experience_indexes == [0, 1]


async def test_cv_prompt_lists_only_selected_experiences(profile, offer):
    draft = {"headline": "DevOps", "summary": "Résumé.", "experiences": []}
    llm = FakeLLM({"CvDraft": draft})
    selection = Selection(requirements=["Kubernetes"], experience_indexes=[0])
    result = await LLMWriter(llm).write_cv(profile, offer, selection, "en")
    assert result == CvDraft.model_validate(draft)
    assert "Nimbus" in llm.prompts[0] and "Brume" not in llm.prompts[0]
    assert "anglais" in llm.prompts[0]


async def test_demo_writer_keeps_the_profile(profile, offer):
    writer = DemoWriter()
    selection = await writer.select(profile, offer)
    cv = await writer.write_cv(profile, offer, selection, "fr")
    letter = await writer.write_letter(profile, offer, selection, "en")
    assert cv.summary == profile.identity.summary
    assert isinstance(letter, LetterDraft)
    assert "Helio" in letter.paragraphs[0]
