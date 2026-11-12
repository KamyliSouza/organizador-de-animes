// Texto digitado na busca de pessoas (Explorar e Membros do painel da equipe): tira os espaços e o "@" do começo,
// porque quem procura "@ana" espera achar o usuário ana (o banco compara só com o nome de usuário, sem o arroba).
export const cleanProfileQuery = (value) => String(value ?? '').trim().replace(/^@+\s*/, '');
