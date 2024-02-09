'use client'
import React, { useState, useEffect } from 'react'
import Constant from '@/app/_utils/Constant'
import StudentsTable from './_components/StudentsTable'
import CourseSelect from './_components/CourseSelect'
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
} from 'firebase/firestore'
import { app } from '@/firebaseConfig.js'

function Students() {
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedStudents, setSelectedStudents] = useState([])
  const [studentsList, setStudentsList] = useState([])

  const db = getFirestore(app)

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const collectionPath = 'Student'
        const querySnapshot = await getDocs(collection(db, collectionPath))
        const studentsList = []
        querySnapshot.forEach(doc => {
          studentsList.push(doc.data())
        })
        setStudentsList(studentsList)
        console.log('Students:', studentsList)
      } catch (error) {
        console.error('Error fetching students list:', error)
      }
    }
    fetchStudents()
  }, [db])

  const handleSelectCourse = courseId => {
    setSelectedCourse(courseId)
    console.log('Selected course:', courseId)
  }

  const handleSelectStudents = studentIds => {
    setSelectedStudents(studentIds)
    console.log('Selected students:', studentIds) // Print the selected students to the console
  }

  const handleAddStudentsClick = () => {
    console.log('Selected students:', selectedStudents)
    // Add logic to handle adding students
  }

  return (
    <div>
      <h2 className='text-[26px] font-medium p-5'>Manage Students</h2>
      {/* flex flex-col items-center justify-center pt-5 pb-6 */}
      <div className='m-5 w-40'>
        <CourseSelect onSelectCourse={handleSelectCourse} />
      </div>
      <div className='pl-10 pr-10 pt-5'>
        <StudentsTable
          students={studentsList}
          onSelectStudents={handleAddStudentsClick}
        />
      </div>

      <div
        className='flex flex-col items-center 
        justify-center pt-5 pb-6'
      >
        <button
          onClick={handleAddStudentsClick}
          className='p-2 bg-primary text-white w-[30%] rounded-full mt-5 disabled:bg-gray-400'
        >
          Add Students
        </button>
      </div>
    </div>
  )
}

export default Students
