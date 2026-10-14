import "./Button.css";

// Presentational only (no hooks, no handlers of its own), so it needs no
// directive: it is server code when a server component renders it and simply
// joins the client bundle when a client component does.
export default function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const classes = ["btn", `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(" ");
  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
