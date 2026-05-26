async function getCourses() {}
async function getLessons() {}
async function getSubtitles() {}
async function getCourses(){

  return [

    {
      title:"Contabilidade Empresarial",
      description:"Aprenda contabilidade do zero."
    },

    {
      title:"ICMS na prática",
      description:"Curso completo sobre ICMS e tributação."
    },

    {
      title:"Departamento Fiscal",
      description:"Entenda impostos e obrigações fiscais."
    },

    {
      title:"Excel para empresas",
      description:"Automatize planilhas e relatórios."
    },

    {
      title:"Auditoria Financeira",
      description:"Aprenda auditoria profissional."
    },

    {
      title:"Gestão Empresarial",
      description:"Administração e crescimento."
    }

  ]

}

async function renderCourses(){

  const container =
  document.getElementById("coursesContainer")

  if(!container) return

  try{

    const courses = await getCourses()

    container.innerHTML =
    courses.slice(0,6).map(course => `

      <div class="resource">

        <div class="resource-title">
          ${course.title || "Curso"}
        </div>

        <div class="resource-desc">
          ${course.description || "Curso recomendado"}
        </div>

      </div>

    `).join("")

  }catch(error){

    console.error(error)

  }

}

renderCourses()
