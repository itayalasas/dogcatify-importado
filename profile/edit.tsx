@@ .. @@
   const uploadImageToStorage = async (imageAsset: ImagePicker.ImagePickerAsset): Promise<string> => {
     try {
       setUploadingImage(true);
     }
   }
-      const filename = `profiles/${currentUser!.id}/${Date.now()}.jpg`;
+      // Crear una estructura de carpetas más organizada
+      const filename = `profiles/${currentUser!.id}/avatar/${Date.now()}.jpg`;
       
       try {
         const formData = new FormData();
       }