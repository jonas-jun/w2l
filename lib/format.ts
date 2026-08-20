export function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function formatRelativeTime(dateString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

  if (diffSec < 60) return "방금 전";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffDay < 30) return `${diffWeek}주 전`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffDay < 365) return `${diffMonth}개월 전`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}년 전`;
}
