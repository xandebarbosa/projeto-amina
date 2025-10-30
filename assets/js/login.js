document.addEventListener('DOMContentLoaded', () => {
    // "Banco de dados" simulado para profissionais
    const professionals = {
        saude: ["CRM-12345", "CRM-67890", "SAUDE-001"],
        juridico: ["OAB-45678", "OAB-98765", "JUR-999"]
    };

    const loginForm = document.getElementById('login-form');
    const credForm = document.getElementById('cred-form');
    const loginSection = document.getElementById('login-section');
    const credSection = document.getElementById('cred-section');
    const credResult = document.getElementById('cred-result');

    // Função para registrar o login e redirecionar
    function successfulLogin(redirectPage = 'home.html') {
        // >>> PASSO CHAVE: Salva o estado de login no sessionStorage <<<
        sessionStorage.setItem('isLoggedIn', 'true');
        
        // Redireciona para a página principal
        window.location.href = redirectPage;
    }

    // Lida com o formulário de login inicial
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const role = document.getElementById('role').value;

        if (role === 'usuario') {
            alert('Bem-vinda à Amina!');
            //window.location.href = 'home.html';
            successfulLogin(); // Chama a nova função
        } else if (role === 'saude' || role === 'juridico') {
            loginSection.style.display = 'none';
            credSection.style.display = 'block';
            document.getElementById('cred-type').value = role; // Preenche o tipo no segundo form
        }
    });

    // Lida com a verificação de credencial
    credForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const type = document.getElementById('cred-type').value;
        const credential = document.getElementById('credential').value.trim();
        
        if (professionals[type] && professionals[type].includes(credential)) {
            credResult.style.color = 'green';
            credResult.textContent = '✅ Credencial válida. Acesso permitido. Redirecionando...';
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
        } else {
            credResult.style.color = 'red';
            credResult.textContent = '❌ Credencial inválida ou não encontrada.';
        }
    });
});