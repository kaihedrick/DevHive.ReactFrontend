import { useNavigate } from 'react-router-dom';
/**
 * useNavigation
 *
 * Custom hook to simplify navigation using React Router's `useNavigate` hook.
 *
 * @returns {Function} A function that accepts a path string and navigates to it.
 *
 * @example
 * const navigateTo = useNavigation();
 * navigateTo("/dashboard");
 */
export const useNavigation = () => {
  const navigate = useNavigate();

  return (path) => {
    navigate(path);
  };
};
