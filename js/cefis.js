const API_URL =
"https://tutor-evolutivo-ai.onrender.com"

// =====================================================
// PEGAR CURSOS
// =====================================================

async function getCourses(){

  try{

    const response =
    await fetch(
      `${API_URL}/courses`
    )

    const data =
    await response.json()

    return data.data || []

  }catch(error){

    console.error(
      "Erro cursos:",
      error
    )

    // FALLBACK MOCK
    return [

      {
        title:"Contabilidade Empresarial",
        description:"Aprenda contabilidade do zero."
      },

      {
        title:"ICMS na prática",
        description:"Curso completo sobre ICMS."
      },

      {
        title:"Departamento Fiscal",
        description:"Entenda impostos."
      }

    ]

  }

}

// =====================================================
// PEGAR AULAS
// =====================================================

async function getLessons(courseId){

  try{

    const response =
    await fetch(
      `${API_URL}/lessons/${courseId}`
    )

    const data =
    await response.json()

    return data.data || []

  }catch(error){

    console.error(
      "Erro lessons:",
      error
    )

    return []

  }

}

// =====================================================
// PEGAR LEGENDAS
// =====================================================

async function getSubtitles(lessonId){

  try{

    const response =
    await fetch(
      `${API_URL}/subtitles/${lessonId}`
    )

    const data =
    await response.json()

    return data.data || []

  }catch(error){

    console.error(
      "Erro subtitles:",
      error
    )

    return []

  }

}

// =====================================================
// RENDERIZAR CURSOS
// =====================================================

async function renderCourses(){

  const container =
  document.getElementById(
    "coursesContainer"
  )

  if(!container) return

  try{

    const courses =
    await getCourses()

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
