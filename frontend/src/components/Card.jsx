import PropTypes from "prop-types";

function Card({ children, className = "", hover = true }) {
  return (
    <div
      className={`glass-card-premium ${hover ? "hover:translate-y-[-3px]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  hover: PropTypes.bool,
};

export default Card;
