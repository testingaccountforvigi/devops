// =============================================================
//  LoanPro — Jenkins Pipeline
//  Fully self-contained: no external credentials required.
//
//  What it does:
//    1. Checkout code from GitHub
//    2. Build backend Docker image (Node.js/Express)
//    3. Build frontend Docker image (Nginx)
//    4. Load both images into minikube's Docker daemon
//    5. Apply all Kubernetes manifests  (kubectl apply -f k8s/)
//    6. Wait for rollout and verify pods/services
//
//  DockerHub username : mahesh3003
//  GitHub repo        : https://github.com/testingaccountforvigi/DevOps
//  Kubeconfig         : k8s/kubeconfig-jenkins.yaml (embedded certs)
//  Minikube API       : https://192.168.49.2:8443  (stable internal IP)
// =============================================================

pipeline {

    agent any

    environment {
        BACKEND_IMAGE  = 'loan-backend:latest'
        FRONTEND_IMAGE = 'loan-frontend:latest'
        K8S_NAMESPACE  = 'loan-system'
        KUBECONFIG     = "${WORKSPACE}/k8s/kubeconfig-jenkins.yaml"
        KUBECTL        = "${WORKSPACE}/.bin/kubectl"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 20, unit: 'MINUTES')
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        // ─────────────────────────────────────────────────────
        // STAGE 1 — Checkout
        // Pulls latest code from GitHub main branch.
        // Repo: https://github.com/testingaccountforvigi/DevOps
        // ─────────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo '=== Stage 1: Checkout ==='
                checkout scm
                sh '''
                    echo "Branch : $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
                    echo "Commit : $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
                    echo "Files  : $(ls -1 | tr '\n' ' ')"
                '''
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 2 — Install kubectl
        // Auto-detects CPU architecture (amd64 / arm64) so the
        // correct binary is downloaded whether Jenkins runs on
        // x86_64 or Apple-Silicon (aarch64) hardware.
        // Always re-downloads to clear any stale/wrong-arch binary.
        // ─────────────────────────────────────────────────────
        stage('Install kubectl') {
            steps {
                echo '=== Stage 2: Install kubectl ==='
                sh '''
                    mkdir -p "${WORKSPACE}/.bin"

                    # Detect architecture: x86_64 → amd64, aarch64 → arm64
                    ARCH=$(uname -m | sed "s/x86_64/amd64/;s/aarch64/arm64/;s/armv7l/arm/")
                    echo "Detected arch: ${ARCH}"

                    echo "Downloading kubectl for linux/${ARCH}..."
                    curl -sSLo "${KUBECTL}" \
                        "https://dl.k8s.io/release/v1.29.0/bin/linux/${ARCH}/kubectl"

                    # Use chmod 755 — more explicit than +x
                    chmod 755 "${KUBECTL}"

                    echo "kubectl binary info:"
                    file "${KUBECTL}" || true
                    "${KUBECTL}" version --client
                '''
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 3 — Build Backend Docker Image
        // Build context is project root so the Dockerfile can
        // reach both backend/ and database/ directories.
        // ─────────────────────────────────────────────────────
        stage('Build Backend Image') {
            steps {
                echo "=== Stage 3: Build ${BACKEND_IMAGE} ==="
                sh """
                    docker build \\
                        -t ${BACKEND_IMAGE} \\
                        -f backend/Dockerfile \\
                        .
                    echo "Backend image built:"
                    docker images ${BACKEND_IMAGE}
                """
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 4 — Build Frontend Docker Image
        // Build context is frontend/ — all HTML/CSS/JS files.
        // ─────────────────────────────────────────────────────
        stage('Build Frontend Image') {
            steps {
                echo "=== Stage 4: Build ${FRONTEND_IMAGE} ==="
                sh """
                    docker build \\
                        -t ${FRONTEND_IMAGE} \\
                        -f frontend/Dockerfile \\
                        frontend/
                    echo "Frontend image built:"
                    docker images ${FRONTEND_IMAGE}
                """
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 5 — Load Images into Minikube
        // Saves images from the host Docker daemon and loads
        // them directly into minikube's internal Docker daemon.
        // This avoids needing DockerHub credentials entirely.
        // ─────────────────────────────────────────────────────
        stage('Load Images into Minikube') {
            steps {
                echo '=== Stage 5: Load images into minikube ==='
                sh """
                    echo "--- Loading backend image into minikube ---"
                    docker save ${BACKEND_IMAGE} | \
                        docker exec -i minikube docker load

                    echo "--- Loading frontend image into minikube ---"
                    docker save ${FRONTEND_IMAGE} | \
                        docker exec -i minikube docker load

                    echo "--- Images now in minikube ---"
                    docker exec minikube docker images | grep -E "loan-|REPO"
                """
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 6 — Kubernetes Deployment
        // Applies every manifest in k8s/ to the loan-system
        // namespace, then waits for each deployment to roll out.
        // kubectl uses k8s/kubeconfig-jenkins.yaml which has
        // all certs embedded and points to 192.168.49.2:8443.
        // ─────────────────────────────────────────────────────
        stage('Kubernetes Deployment') {
            steps {
                echo '=== Stage 6: Deploy to Kubernetes ==='
                sh """
                    export KUBECONFIG=${KUBECONFIG}

                    echo "--- Cluster connection ---"
                    ${KUBECTL} cluster-info --request-timeout=10s

                    echo "--- Applying all manifests ---"
                    ${KUBECTL} apply -f k8s/ --ignore-not-found=true

                    echo "--- Waiting for MySQL ---"
                    ${KUBECTL} rollout status deployment/mysql \\
                        -n ${K8S_NAMESPACE} --timeout=120s

                    echo "--- Waiting for backend ---"
                    ${KUBECTL} rollout status deployment/backend \\
                        -n ${K8S_NAMESPACE} --timeout=120s

                    echo "--- Waiting for frontend ---"
                    ${KUBECTL} rollout status deployment/frontend \\
                        -n ${K8S_NAMESPACE} --timeout=120s
                """
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 7 — Deployment Verification
        // Prints a full status report: pods, services,
        // deployments, ingress, and HPA.
        // ─────────────────────────────────────────────────────
        stage('Deployment Verification') {
            steps {
                echo '=== Stage 7: Verify deployment ==='
                sh """
                    export KUBECONFIG=${KUBECONFIG}

                    echo "========================================"
                    echo "  PODS  (namespace: ${K8S_NAMESPACE})"
                    echo "========================================"
                    ${KUBECTL} get pods -n ${K8S_NAMESPACE} -o wide

                    echo ""
                    echo "========================================"
                    echo "  SERVICES"
                    echo "========================================"
                    ${KUBECTL} get services -n ${K8S_NAMESPACE}

                    echo ""
                    echo "========================================"
                    echo "  DEPLOYMENTS"
                    echo "========================================"
                    ${KUBECTL} get deployments -n ${K8S_NAMESPACE}

                    echo ""
                    echo "========================================"
                    echo "  INGRESS"
                    echo "========================================"
                    ${KUBECTL} get ingress -n ${K8S_NAMESPACE}

                    echo ""
                    echo "========================================"
                    echo "  HPA"
                    echo "========================================"
                    ${KUBECTL} get hpa -n ${K8S_NAMESPACE}
                """
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // POST ACTIONS
    // ─────────────────────────────────────────────────────────
    post {
        success {
            echo '''
==================================================
  BUILD SUCCEEDED
  LoanPro is running on Kubernetes.
  Dashboard : http://localhost:8080
  App       : http://192.168.49.2:30080
=================================================='''
        }

        failure {
            echo '=== BUILD FAILED — printing pod events for debugging ==='
            sh """
                export KUBECONFIG=${KUBECONFIG} || true
                ${KUBECTL} get events -n ${K8S_NAMESPACE} \\
                    --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || true
            """
        }

        always {
            echo '=== Cleaning up dangling Docker images ==='
            sh 'docker image prune -f || true'
        }
    }
}
