import { Geist_Mono } from 'next/font/google';
import FooterScrollExperience from '@/components/landing/FooterScrollExperience';

// 시안 전용: Geist Mono를 이 페이지에만 로드. 채택 시 layout으로 옮긴다.
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

/**
 * 푸터 디자인 시안(메인 미반영). 묵직한 스크롤 + LUN이 따라오다 푸터에서 페이드아웃.
 * 실제 메인(app/page.tsx)은 그대로 두고 여기서만 미리보기.
 */
export default function FooterTestPage() {
  return (
    <div className={geistMono.variable}>
      <FooterScrollExperience />
    </div>
  );
}
