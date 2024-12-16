import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import '../styles/projects.css';

const Projects = () => {
  const projects = [
    { id: 1, name: 'Flappy Bird Game' },
    { id: 2, name: 'To-Do App' },
    { id: 3, name: 'Music App' },
  ];

  return (
    <Container className="projects-container">
      <h1 className="text-center mb-4">Welcome to DevHive "User"!</h1>
      <h2 className="text-center mb-4">Projects:</h2>
      <Row className="justify-content-center">
        {projects.map((project) => (
          <Col key={project.id} md={4} className="mb-4">
            <Card className="project-card">
              <Card.Body className="text-center">
                <div className="project-pic mb-3">PIC</div>
                <Card.Title>{project.name}</Card.Title>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <div className="button-group d-flex justify-content-center mt-4">
        <button className="custom-button mx-2">Create a Project</button>
        <button className="custom-button mx-2">Join a Group</button>
      </div>
    </Container>
  );
};

export default Projects;
