// Reusable button component for form actions
const SubmitButton = ({ label, isActive, onClick }) => (
    <div
      className={isActive ? "submit" : "submit gray"} //toggle for login and register
      onClick={onClick} // Event handler
    >
      {label} {/* Button label */}
    </div>
  );
  
  export default SubmitButton;
  