// Google Apps Script 웹 앱. 실행 사용자는 설문 소유자이며, 서버에서만 호출한다.
const LUN_SURVEYS = {
  create: { formId: '1s4BumBV8ffhvIR2ptGaYLddu25GmpnrYmppoi4Pd7GM', codeItemId: 1325396999 },
  easy: { formId: '1OPsIM2YnKAV7IZnhZ6wu2PTtkWVWq1AWqg5yjMQvKB4', codeItemId: 1452786578 },
};

function jsonResult(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function checkSetup() {
  const secret = PropertiesService.getScriptProperties().getProperty('LUN_SURVEY_SYNC_SECRET');
  const forms = Object.keys(LUN_SURVEYS).map(function (mode) {
    const config = LUN_SURVEYS[mode];
    const form = FormApp.openById(config.formId);
    return { mode: mode, title: form.getTitle(), codeField: form.getItemById(config.codeItemId).getTitle() };
  });
  console.log(JSON.stringify({ secretConfigured: Boolean(secret && secret.length >= 32), forms: forms }));
}

function doPost(event) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('LUN_SURVEY_SYNC_SECRET');
    const body = JSON.parse(event.postData.contents);
    if (!secret || secret.length < 32 || body.secret !== secret) return jsonResult({ ok: false });
    const config = LUN_SURVEYS[body.mode];
    if (!Object.prototype.hasOwnProperty.call(LUN_SURVEYS, body.mode) || !/^[a-f0-9]{64}$/.test(body.code)) {
      return jsonResult({ ok: false });
    }
    if (!Number.isSafeInteger(body.since) || body.since <= 0 || body.since > Date.now()) {
      return jsonResult({ ok: false });
    }
    const form = FormApp.openById(config.formId);
    const responses = form.getResponses(new Date(Math.max(0, body.since - 60000)));
    const match = responses.find(function (response) {
      return response.getItemResponses().some(function (answer) {
        return answer.getItem().getId() === config.codeItemId && answer.getResponse() === body.code;
      });
    });
    return jsonResult({ ok: true, completed: Boolean(match), submittedAt: match ? match.getTimestamp().getTime() : null });
  } catch (_error) {
    return jsonResult({ ok: false });
  }
}
