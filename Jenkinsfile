pipeline {
agent any

stages {
    stage('Checkout') {
        steps {
            echo 'Repository already checked out by Jenkins'
        }
    }
    stage('Build') {
        steps {
            sh 'echo Building Application'
        }
    }
    stage('Docker Validation') {
        steps {
            sh 'docker --version'
            sh 'docker ps'
        }
    }
    stage('Deploy') {
        steps {
            sh 'docker compose up -d'
        }
    }
    stage('Health Check') {
        steps {
            sh 'docker ps'
        }
    }
}
post {
    success {
        echo 'Pipeline completed successfully'
    }
    failure {
        echo 'Pipeline failed'
    }
}

}