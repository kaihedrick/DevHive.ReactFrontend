
//this file will be used primarily in the LoginRegister component as a reusable form input field 
// that accepts props to dynamically render input elements with specific attributes
const InputField = ({ icon, type, name, placeholder, value, onChange, error }) => (
    <div className="input-container">

      {error && <p className="error-message">{error}</p>}
  
      <div className="input">
        <img src={icon} alt={`${name} Icon`} />
        <input
          type={type}
          name={name}
          placeholder={placeholder} 
          value={value} 
          onChange={onChange} 
        />
      </div>
    </div>
  );
  
  export default InputField;
  