import { doc, setDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

// 이 브라우저(기기)를 식별하는 '안정적' id. localStorage에 1회 만들어 재사용한다.
// 로드마다 새 UUID를 쓰면 같은 기기의 두 번째 탭·새로고침·PWA·탭복원이 서로를
// '다른 기기'로 오인해 자기 자신을 로그아웃시켰다(단일 세션 오발동). 기기당 고정 id면
// 같은 기기의 여러 컨텍스트는 서로 밀어내지 않고, 진짜 다른 기기에서 로그인할 때만
// id가 달라 기존 기기가 정상적으로 로그아웃된다(의도된 단일 세션 동작 유지).
const DEVICE_KEY = 'lun.deviceId';

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // localStorage 사용 불가(프라이빗 모드 등) → 이 로드 한정 임시 id.
    // 이런 컨텍스트는 어차피 저장소가 격리되므로 탭 간 공유 대상이 아니다.
    return crypto.randomUUID();
  }
}

/** 이 기기를 활성 세션으로 등록하고 기기 id를 반환(다른 기기 세션을 밀어냄). */
export async function claimSession(uid: string): Promise<string> {
  const id = getDeviceId();
  await setDoc(doc(db, 'sessions', uid), { activeToken: id, updatedAt: serverTimestamp() });
  return id;
}

/** activeToken이 내 기기와 달라지면(=다른 기기 로그인) onKicked 호출. */
export function watchSession(uid: string, myId: string, onKicked: () => void): Unsubscribe {
  return onSnapshot(doc(db, 'sessions', uid), (snap) => {
    const tok = snap.data()?.activeToken as string | undefined;
    if (tok && tok !== myId) onKicked();
  });
}
