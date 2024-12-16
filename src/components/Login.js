import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Form, Button, Container, Card } from 'react-bootstrap';
import '../styles/login_register.css';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials({ ...credentials, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://localhost:7170/api/User/ProcessLogin/', credentials);
      const { token } = response.data;

      // Save token in localStorage
      localStorage.setItem('authToken', token);

      setSuccess(true);
      setError('');
      navigate('/projects'); // Redirect to Projects page
    } catch (err) {
      setError('Invalid username or password');
      setSuccess(false);
    }
  };

  return (
    <Container className="d-flex flex-column align-items-center justify-content-center" style={{ height: '100vh' }}>
      <Card style={{ width: '25rem', padding: '1.5rem', borderRadius: '15px', backgroundColor: '#fff3cd' }}>
        <Card.Body>
          <h2 className="text-center mb-4">Welcome Back</h2>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">Login successful!</p>}
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="username" className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                name="username"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={handleChange}
                required
              />
            </Form.Group>
            <Form.Group controlId="password" className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                name="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={handleChange}
                required
              />
            </Form.Group>
            <div className="button-group d-flex justify-content-between">
              <Button variant="warning" type="submit">
                Login
              </Button>
              <Button variant="warning" onClick={() => navigate('/register')}>
                Register
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login;
