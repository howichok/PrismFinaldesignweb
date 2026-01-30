import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/lib/notifications/format";
import type { NotificationItem as NotificationItemType } from "@/lib/notifications/types";

type NotificationItemProps = {
  item: NotificationItemType;
  compact?: boolean;
  onClick?: (item: NotificationItemType) => void;
  onMarkRead?: (item: NotificationItemType) => void;
};

function truncateText(value: string, maxLength = 140) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

export default function NotificationItem({
  item,
  compact,
  onClick,
  onMarkRead,
}: NotificationItemProps) {
  const handleClick = () => {
    onClick?.(item);
  };
  const bodyText = truncateText(item.body);

  return (
    <div
      className={cn(
        "notifications__item",
        !item.isRead && "notifications__item--unread",
        compact && "cursor-pointer"
      )}
      onClick={compact ? handleClick : undefined}
      role={compact ? "button" : undefined}
      tabIndex={compact ? 0 : undefined}
      onKeyDown={
        compact
          ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleClick();
            }
          }
          : undefined
      }
    >
      <div className="notifications__item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      </div>
      <div className="notifications__item-content">
        <div className="notifications__item-title">
          {item.title}
        </div>
        <div className="notifications__item-message">
          {bodyText}
        </div>
        <div className="notifications__item-time">
          {formatTimeAgo(item.createdAt)}
        </div>
      </div>
    </div>
  );
}
