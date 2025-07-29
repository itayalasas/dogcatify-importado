#!/bin/bash
echo "Fixing Gradle encoding setting..."
echo "org.gradle.jvmargs=-Dfile.encoding=UTF-8" >> android/gradle.properties
