/**
 * Form Validation Hook
 * 
 * Provides reusable form validation utilities
 */

import { useState, useCallback } from "react";

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
  email?: boolean;
  url?: boolean;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

export interface ValidationErrors {
  [key: string]: string;
}

export function useFormValidation<T extends Record<string, string>>(
  initialValues: T,
  rules: ValidationRules
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (name: string, value: string): string | null => {
      const rule = rules[name];
      if (!rule) return null;

      if (rule.required && !value.trim()) {
        return `${name.charAt(0).toUpperCase() + name.slice(1)} is required`;
      }

      if (value.trim() && rule.minLength && value.length < rule.minLength) {
        return `Must be at least ${rule.minLength} characters`;
      }

      if (value.trim() && rule.maxLength && value.length > rule.maxLength) {
        return `Must be no more than ${rule.maxLength} characters`;
      }

      if (value.trim() && rule.pattern && !rule.pattern.test(value)) {
        return `Invalid format`;
      }

      if (value.trim() && rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Please enter a valid email address";
      }

      if (value.trim() && rule.url && !/^https?:\/\/.+/.test(value)) {
        return "Please enter a valid URL (must start with http:// or https://)";
      }

      if (value.trim() && rule.custom) {
        return rule.custom(value);
      }

      return null;
    },
    [rules]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    Object.keys(rules).forEach((key) => {
      const error = validateField(key, values[key] || "");
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, rules, validateField]);

  const handleChange = useCallback(
    (name: string, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      
      // Clear error when user starts typing
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const handleBlur = useCallback(
    (name: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      const error = validateField(name, values[name] || "");
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [values, validateField]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    setValues,
    setErrors,
  };
}
