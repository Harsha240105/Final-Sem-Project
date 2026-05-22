import PropTypes from "prop-types";

const gradients = {
  cyan: "text-gradient-cyan",
  purple: "text-gradient-purple",
  pink: "text-gradient-pink",
  green: "text-gradient-green",
  flow: "text-gradient-flow",
};

function GradientText({ children, variant = "cyan", className = "", as: Tag = "span", ...props }) {
  return (
    <Tag className={`${gradients[variant] || gradients.cyan} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

GradientText.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(["cyan", "purple", "pink", "green", "flow"]),
  className: PropTypes.string,
  as: PropTypes.string,
};

export default GradientText;
