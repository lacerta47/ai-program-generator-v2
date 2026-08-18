import LegalPage from '@/components/common/LegalPage';

export const metadata = { title: '소개 — LUN' };

export default function AboutPage() {
  return (
    <LegalPage title="LUN 소개">
      <p>
        <strong>LUN(룬)</strong>은 <em>Logic Unfold Next</em>의 줄임말입니다. 웹 주소 <strong>eduai-lun</strong>을 따서
        <strong>에듀에이아이룬</strong>, 줄여서 <strong>룬</strong>이라고 부릅니다. 논리를 펼치면 다음이 열린다는 뜻으로, 초등학교
        저학년 어린이가 자기 생각을 차근차근 풀어 쓰는 것만으로 진짜 움직이는 프로그램을 만들어 볼 수 있게 하는 서비스입니다.
      </p>

      <h2>무엇을 할 수 있나요</h2>
      <ul>
        <li>
          <strong>만들기</strong> — 어떤 프로그램을 만들고 싶은지 이름·모습·사용법·동작을 우리말로 적으면, 인공지능이 그대로
          만들어 줍니다.
        </li>
        <li>
          <strong>골라서 만들기</strong> — 아직 글로 쓰기 어려운 어린이는 그림판·게임·퀴즈 같은 종류를 고르고 질문에 답하기만
          하면 됩니다.
        </li>
        <li>
          <strong>고치기</strong> — 만든 프로그램이 마음에 들지 않으면 &ldquo;이렇게 되면 좋겠어&rdquo;라고 말해서 고칠 수
          있습니다.
        </li>
        <li>
          <strong>나누기</strong> — 완성한 작품을 게시판에 올려 친구들과 나누고, 친구의 작품을 이어서 더 키워 볼 수 있습니다.
        </li>
      </ul>

      <h2>무엇을 배우게 되나요</h2>
      <p>
        LUN은 코드를 외우게 하지 않습니다. 대신 <strong>순서 · 조건 · 반복 · 입력 · 출력</strong>이라는 컴퓨팅의 기본 생각을,
        자기가 만든 작품 안에서 발견하게 합니다. 작품마다 어떤 개념을 썼는지 보여 주고, 그 개념이 내 작품 어디에 쓰였는지
        쉬운 말로 알려 줍니다.
      </p>
      <p>
        중요한 것은 &lsquo;프로그램을 잘 만드는 것&rsquo;이 아니라, <strong>내가 원하는 것을 또렷하게 설명하는 힘</strong>을
        기르는 일이라고 생각합니다.
      </p>

      <h2>교실에서 쓰는 경우</h2>
      <p>
        선생님은 학급 계정을 만들어 학생들에게 나눠 줄 수 있습니다. 학급 게시판은 그 반 학생과 선생님에게만 보이고, 학부모께는
        관람 PIN이 있는 공유 링크로 작품을 보여 드릴 수 있습니다. 선생님은 학생별 활동 현황과 어떤 개념을 익혔는지도 확인할 수
        있습니다.
      </p>

      <h2>안전하게 쓰기 위해</h2>
      <ul>
        <li>어린이에게 부적절한 내용이 만들어지지 않도록 여러 단계의 안전장치를 두고 있습니다.</li>
        <li>사진이 들어간 작품은 학급 게시판에만 올릴 수 있고, 공개 게시판에는 올라가지 않습니다.</li>
        <li>부적절한 작품은 누구나 신고할 수 있고, 담당 선생님이 바로 확인합니다.</li>
        <li>
          자세한 내용은 <a href="/privacy">개인정보처리방침</a>과 <a href="/terms">이용약관</a>을 참고해 주세요.
        </li>
      </ul>

      <h2>만든 곳</h2>
      <table>
        <tbody>
          <tr>
            <th>상호</th>
            <td>아름다운교육연구소</td>
          </tr>
          <tr>
            <th>대표자</th>
            <td>안명훈</td>
          </tr>
          <tr>
            <th>사업자등록번호</th>
            <td>486-14-02776</td>
          </tr>
          <tr>
            <th>주소</th>
            <td>강원특별자치도 춘천시 서면 박사로 854, 3층</td>
          </tr>
          <tr>
            <th>문의</th>
            <td>
              <a href="mailto:amh4753@gmail.com">amh4753@gmail.com</a>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        서비스에 대한 의견이나 개선 제안은 언제든 환영합니다. 위 이메일로 알려 주세요.
      </p>
    </LegalPage>
  );
}
