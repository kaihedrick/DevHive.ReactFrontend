import React from "react";
import clsx from "clsx";
import styles from "./InputField.module.css";

export type InputFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | boolean;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
};

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, leftIcon, rightIcon, containerClassName, className, id, ...inputProps }, ref) => {
    const inputId = id || (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    const describedBy: string[] = [];
    if (hint && inputId) describedBy.push(`${inputId}-hint`);
    if (typeof error === "string" && inputId) describedBy.push(`${inputId}-error`);

    return (
      <div className={clsx(styles.inputField, containerClassName, error && styles["is-error"])}>
        {label && (
          <label className={styles.label} htmlFor={inputId}>
            {label}
          </label>
        )}
        <div className={styles.controlWrap}>
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
          <input
            id={inputId}
            ref={ref}
            className={clsx(styles.control, className)}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy.length ? describedBy.join(" ") : undefined}
            {...inputProps}
          />
          {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
        </div>
        {hint && inputId && (
          <div id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </div>
        )}
        {typeof error === "string" && inputId && (
          <div id={`${inputId}-error`} className={styles.error}>
            {error}
          </div>
        )}
      </div>
    );
  }
);

InputField.displayName = "InputField";
export default InputField;
