import { useNavigate } from "react-router-dom";
import UserHoverCard from "./UserHoverCard";

export default function ProfileLink({
  userId,
  children,
  className = "",
  showHoverCard = true,
  onClick,
}) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
    }
  };

  const content = (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center cursor-pointer transition-colors duration-200 hover:text-cyan-400 ${className}`}
    >
      {children}
    </span>
  );

  if (showHoverCard && userId) {
    return (
      <UserHoverCard userId={userId}>
        {content}
      </UserHoverCard>
    );
  }

  return content;
}
