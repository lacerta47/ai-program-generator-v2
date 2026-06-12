// 도움말 말풍선 내용(계획서 폼 라벨·수정 요청 박스 공용).
export function Tip({ lead, examples }: { lead: string; examples: string[] }) {
  return (
    <>
      <p>{lead}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {examples.map((ex) => (
          <li key={ex} className="rounded-[8px] bg-surface-2 px-2.5 py-1 text-[12.5px] text-muted">
            {ex}
          </li>
        ))}
      </ul>
    </>
  );
}
